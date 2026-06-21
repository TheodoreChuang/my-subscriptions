import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { authCapability } from '@/infrastructure/auth'
import { SignInPage } from '@/frontend/auth/SignInPage'

export default async function SignInRoute({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await authCapability.getSession(await headers())
  if (session) redirect('/report')

  const { error } = await searchParams
  return <SignInPage errorParam={error} />
}
