import { ReactNode } from "react";

interface Props {
  id?: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  children: ReactNode;
  className?: string;
}

const Section = ({ id, eyebrow, title, lead, children, className = "" }: Props) => (
  <section id={id} className={`scroll-mt-20 py-16 md:py-24 ${className}`}>
    <div className="container max-w-6xl">
      <div className="max-w-2xl mb-10 md:mb-14">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">{eyebrow}</p>}
        <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">{title}</h2>
        {lead && <p className="mt-4 text-base md:text-lg text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </div>
  </section>
);

export default Section;
