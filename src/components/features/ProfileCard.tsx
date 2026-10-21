interface ProfileCardProps {
  parroquiaNombre: string;
  rol: string;
}

export function ProfileCard({ parroquiaNombre, rol }: ProfileCardProps) {
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-lg bg-white p-6 shadow-sm">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-3xl">
        🛡️
      </div>

      <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
        {parroquiaNombre}
      </span>

      <span className="rounded-md bg-slate-800 px-3 py-1 text-xs font-semibold text-white">
        Rol: {rol}
      </span>
    </div>
  );
}