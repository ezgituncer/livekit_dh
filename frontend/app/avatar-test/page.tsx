'use client';

// TEMPORARY dev page to verify the digital-human avatar renders in isolation,
// without needing a LiveKit connection. Safe to delete after verification.
import { AvatarCanvas } from '@/components/digital-human/avatar-canvas';

export default function AvatarTestPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111' }}>
      <AvatarCanvas />
    </div>
  );
}
