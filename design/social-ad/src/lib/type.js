// Kinetic type: lines laid out glyph by glyph (keeping the font's kerning),
// then drawn with a per-glyph effect function.

export const fontCss = (f) => `${f.style || "normal"} ${f.weight ?? 300} ${f.size}px "${f.family}"`;

export class TypeLine {
  constructor(ctx, text, f) {
    this.text = text;
    this.f = f;
    ctx.save();
    ctx.font = fontCss(f);
    // Cumulative substring widths keep kerning pairs intact.
    this.base = [];
    this.adv = [];
    let prev = 0;
    for (let i = 0; i < text.length; i++) {
      const w = ctx.measureText(text.slice(0, i + 1)).width;
      this.base.push(prev);
      this.adv.push(w - prev);
      prev = w;
    }
    this.natural = prev;
    const m = ctx.measureText(text);
    this.ascent = m.actualBoundingBoxAscent;
    this.descent = m.actualBoundingBoxDescent;
    ctx.restore();
    // word index per glyph
    this.word = [];
    let wi = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === " " && i > 0 && text[i - 1] !== " ") wi++;
      this.word.push(text[i] === " " ? -1 : wi);
    }
    this.words = wi + 1;
  }

  width(tracking = 0) {
    return this.natural + (this.text.length - 1) * tracking * this.f.size;
  }

  /**
   * Draw at (x, baseline y). align: 'left' | 'center' | 'right'.
   * fx(i, ctx) returns {dx, dy, a, rot, sc, blur} per glyph (or null to skip).
   * tracking is in em.
   */
  draw(ctx, x, y, { align = "center", tracking = 0, color = "#EFE8D6", fx = null, clip = null, shadow = null } = {}) {
    const tr = tracking * this.f.size;
    const wTot = this.width(tracking);
    const x0 = align === "center" ? x - wTot / 2 : align === "right" ? x - wTot : x;
    ctx.save();
    if (clip) {
      ctx.beginPath();
      ctx.rect(-10000, y - clip[0], 20000, clip[0] + clip[1]);
      ctx.clip();
    }
    ctx.font = fontCss(this.f);
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    if (shadow) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetY = shadow.oy || 0;
    }
    const baseAlpha = ctx.globalAlpha;
    for (let i = 0; i < this.text.length; i++) {
      const ch = this.text[i];
      if (ch === " ") continue;
      const e = fx ? fx(i, this) : {};
      if (!e) continue;
      const a = e.a ?? 1;
      if (a <= 0.002) continue;
      const gx = x0 + this.base[i] + i * tr;
      const cx = gx + this.adv[i] / 2;
      ctx.globalAlpha = baseAlpha * a;
      ctx.filter = e.blur > 0.35 ? `blur(${e.blur.toFixed(2)}px)` : "none";
      if (e.rot || (e.sc && e.sc !== 1)) {
        ctx.save();
        ctx.translate(cx + (e.dx || 0), y + (e.dy || 0) - this.f.size * 0.3);
        if (e.rot) ctx.rotate(e.rot);
        if (e.sc && e.sc !== 1) ctx.scale(e.sc, e.sc);
        ctx.fillText(ch, -this.adv[i] / 2, this.f.size * 0.3);
        ctx.restore();
      } else {
        ctx.fillText(ch, gx + (e.dx || 0), y + (e.dy || 0));
      }
    }
    ctx.restore();
    return { x0, width: wTot };
  }
}
