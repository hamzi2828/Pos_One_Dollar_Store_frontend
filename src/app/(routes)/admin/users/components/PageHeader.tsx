type Props = { title: string; subtitle?: string };

export default function PageHeader({ title, subtitle }: Props) {
  return (
    <div className="flex flex-col justify-between space-y-4 md:flex-row md:items-center md:space-y-0">
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
