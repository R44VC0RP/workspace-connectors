import Image from "next/image";
import Link from "next/link";

interface InboundWordmarkProps {
  className?: string;
}

export function InboundWordmark({ className }: InboundWordmarkProps) {
  return (
    <Link
      href="https://inbound.new?utm_source=workspace-connect"
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1.5 transition-opacity hover:opacity-80 ${className ?? ""}`}
    >
      <Image
        src="/inbound-logo.svg"
        alt=""
        width={20}
        height={20}
        className="h-5 w-5"
      />
      <span
        style={{ fontFamily: "Outfit, sans-serif" }}
        className="text-base font-medium text-foreground"
      >
        inbound
      </span>
    </Link>
  );
}
