import { ReactNode, useEffect, useRef } from 'react';
import { toast as sonnerToast } from 'sonner';
import { useAgent, useSessionContext } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useI18n } from '@/lib/i18n/i18n';

// How many times to silently reconnect before surfacing a "session ended"
// error. Covers transient agent-join failures ("agent did not join the room").
const MAX_AGENT_RETRIES = 2;

interface ToastProps {
  title: ReactNode;
  description: ReactNode;
}

function toastAlert(toast: ToastProps) {
  const { title, description } = toast;

  return sonnerToast.custom(
    (id) => (
      <Alert onClick={() => sonnerToast.dismiss(id)} className="bg-accent w-full md:w-[364px]">
        <WarningIcon weight="bold" />
        <AlertTitle>{title}</AlertTitle>
        {description && <AlertDescription>{description}</AlertDescription>}
      </Alert>
    ),
    { duration: 10_000 }
  );
}

export function useAgentErrors() {
  const agent = useAgent();
  const { isConnected, end, start } = useSessionContext();
  const { t } = useI18n();
  const retriesRef = useRef(0);

  // Reset the retry budget once the agent is healthily connected again.
  useEffect(() => {
    if (isConnected && agent.state !== 'failed') {
      retriesRef.current = 0;
    }
  }, [isConnected, agent.state]);

  useEffect(() => {
    if (!isConnected || agent.state !== 'failed') return;

    // Transient failure (e.g. "agent did not join the room"): silently
    // reconnect a couple of times before giving up. The mic starts off, same
    // as the initial auto-connect.
    if (retriesRef.current < MAX_AGENT_RETRIES) {
      retriesRef.current += 1;
      void (async () => {
        try {
          await end();
          await start({ tracks: { microphone: { enabled: false } } });
        } catch (err) {
          console.error('Agent reconnect failed', err);
        }
      })();
      return;
    }

    // Retries exhausted — surface the error and stop.
    const reasons = agent.failureReasons;
    toastAlert({
      title: t.sessionEnded,
      description: (
        <>
          {reasons.length > 1 && (
            <ul className="list-inside list-disc">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {reasons.length === 1 && <p className="w-full">{reasons[0]}</p>}
        </>
      ),
    });

    end();
  }, [agent, isConnected, end, start, t]);
}
