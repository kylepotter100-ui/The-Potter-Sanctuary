type Props = {
  data: object;
  id?: string;
};

export default function JsonLd({ data, id }: Props) {
  return (
    <script
      type="application/ld+json"
      id={id}
      // eslint-disable-next-line react/no-danger
      // Escape "<" so no value can ever close the script tag early.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
