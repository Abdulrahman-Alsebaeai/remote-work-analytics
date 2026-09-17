import { redirect } from 'next/navigation';

export default async function ScreenshotsRedirect({ searchParams }: { searchParams: Promise<{ employeeId?: string }> }) {
  const { employeeId } = await searchParams;
  redirect(employeeId ? `/users/${encodeURIComponent(employeeId)}?tab=screenshots` : '/users');
}
