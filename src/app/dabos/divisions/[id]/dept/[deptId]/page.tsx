import { redirect } from 'next/navigation';

import { dabosDeptHref } from '@/lib/dabos/dabos-paths';

type PageProps = { params: Promise<{ id: string; deptId: string }> };

/** Legacy nested URL → canonical /dabos/depts/DeptN */
export default async function LegacyDepartmentRedirect({ params }: PageProps) {
  const { deptId } = await params;
  redirect(dabosDeptHref(deptId));
}
