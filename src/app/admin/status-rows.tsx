export function StatusRows({
  rows,
}: {
  rows: ReadonlyArray<[string, string | number | boolean]>;
}) {
  return (
    <div className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between items-center py-1 border-b border-border last:border-0"
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}
