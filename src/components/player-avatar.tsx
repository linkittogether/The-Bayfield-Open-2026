import Image from "next/image";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

interface PlayerAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes: Record<NonNullable<PlayerAvatarProps["size"]>, { box: string; px: number }> = {
  sm: { box: "w-8 h-8 text-xs", px: 32 },
  md: { box: "w-10 h-10 text-sm", px: 40 },
  lg: { box: "w-14 h-14 text-lg", px: 56 },
};

export function PlayerAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: PlayerAvatarProps) {
  const s = sizes[size];
  return (
    <div
      className={cn(
        "rounded-full overflow-hidden flex items-center justify-center bg-primary text-white font-semibold flex-shrink-0",
        s.box,
        className,
      )}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          width={s.px}
          height={s.px}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
