import Link from "next/link";

type Props = {
  title: string;
  description: string;
  /** Optional extra hint (e.g. what role can do this) */
  hint?: string;
};

/**
 * Full-width friendly screen when a page is not available for the current role.
 */
export function AccessRestricted({ title, description, hint }: Props) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 px-6 py-10 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-3">{title}</h1>
        <p className="text-gray-700 text-sm leading-relaxed mb-4">{description}</p>
        {hint && <p className="text-gray-600 text-xs leading-relaxed mb-6">{hint}</p>}
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Back to home
        </Link>
        <p className="mt-6 text-xs text-gray-500">
          <Link href="/context" className="text-indigo-600 font-medium hover:underline">
            Class & subject
          </Link>
          {" · "}
          <Link href="/login" prefetch={false} className="text-indigo-600 font-medium hover:underline">
            Sign out / switch account
          </Link>
        </p>
      </div>
    </div>
  );
}
