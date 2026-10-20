import type { Metadata } from 'next';
import { currentSession, sessionReady } from '@/lib/wp-control';
import AdminConsole from './AdminConsole';
import './admin.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'WordPress Control', robots: { index: false, follow: false } };

export default async function AdminPage() {
  const ready = sessionReady();
  const session = ready ? await currentSession() : null;
  return <AdminConsole ready={ready} signedIn={Boolean(session)} accountName={session?.username ?? ''} />;
}
