import { Eyebrow } from "./Eyebrow";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  dark?: boolean;
};

/**
 * Consistent section titles. Set `dark` inside navy sections
 * so text flips to white automatically.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  dark = false,
}: SectionHeadingProps) {
  const alignment = align === "center" ? "text-center mx-auto items-center" : "text-left items-start";

  return (
    <div className={`flex max-w-2xl flex-col ${alignment}`}>
      {eyebrow ? (
        <Eyebrow tone={dark ? "light" : "blue"}>{eyebrow}</Eyebrow>
      ) : null}
      <h2
        className={[
          "text-3xl font-extrabold tracking-tight sm:text-[2.75rem] sm:leading-[1.05]",
          dark ? "text-white" : "text-ink",
        ].join(" ")}
      >
        {title}
      </h2>
      {description ? (
        <p className={`mt-3 text-lg ${dark ? "text-white/70" : "text-muted"}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
