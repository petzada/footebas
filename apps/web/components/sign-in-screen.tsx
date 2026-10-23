'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CircleNotch,
  EnvelopeSimple,
  GoogleLogo,
} from '@phosphor-icons/react';
import { Brand } from '@/components/brand';
import { LegalLinks } from '@/components/legal-page';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authErrorMessage, type AuthPort } from '@/lib/auth';

/** Full-page frame shared by the sign-in, loading and callback states. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Brand size="lg" />
          <p className="mt-3 text-sm font-semibold text-chalk drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]">
            Sua carreira, sua história
          </p>
        </div>
        {children}
        <LegalLinks className="mt-6 text-chalk drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]" />
      </div>
    </main>
  );
}

export function AuthPending({ message }: { message: string }) {
  return (
    <AuthFrame>
      <Card>
        <CardContent className="pt-6">
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 text-sm text-muted-foreground"
          >
            <CircleNotch className="size-5 animate-spin text-primary" />
            {message}
          </p>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

type Status = 'idle' | 'google' | 'sending' | 'sent';

export function SignInScreen({
  auth,
  notice = '',
}: {
  auth: AuthPort;
  /** Message carried from the previous session (e.g. it expired). */
  notice?: string;
}) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const emailInput = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const busy = status === 'google' || status === 'sending';

  useEffect(() => {
    if (status === 'sent') confirmation.current?.focus();
  }, [status]);

  const google = async () => {
    setError('');
    setStatus('google');
    try {
      // On success the browser leaves for Google; the button stays busy.
      await auth.signInWithGoogle();
    } catch (caught) {
      setError(authErrorMessage(caught));
      setStatus('idle');
    }
  };

  const sendLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setStatus('sending');
    try {
      await auth.sendMagicLink(email);
      setSentTo(email.trim());
      setStatus('sent');
    } catch (caught) {
      setError(authErrorMessage(caught));
      setStatus('idle');
      emailInput.current?.focus();
    }
  };

  const message = error || notice;

  return (
    <AuthFrame>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xs uppercase">
            {status === 'sent' ? (
              <h1 ref={confirmation} tabIndex={-1} className="outline-none">
                Confira seu e-mail
              </h1>
            ) : (
              <h1>Entre para assumir o clube</h1>
            )}
          </CardTitle>
          {status === 'sent' && (
            <CardDescription>O link de acesso está a caminho.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div aria-live="polite" role="status">
            {status === 'sent' && (
              <p className="text-sm">
                Enviamos um link de acesso para <strong>{sentTo}</strong>.
                Abra-o neste mesmo navegador para entrar. Não chegou? Olhe a
                caixa de spam.
              </p>
            )}
          </div>
          {status === 'sent' ? (
            <div className="mt-5 flex flex-col gap-3">
              <Button
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => {
                  setStatus('idle');
                  setSentTo('');
                }}
              >
                Usar outro e-mail
              </Button>
            </div>
          ) : (
            <FieldGroup>
              <Button
                className="min-h-11 w-full"
                disabled={busy}
                aria-busy={status === 'google'}
                onClick={() => void google()}
              >
                {status === 'google' ? (
                  <CircleNotch
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <GoogleLogo data-icon="inline-start" weight="bold" />
                )}
                {status === 'google'
                  ? 'Abrindo o Google…'
                  : 'Entrar com Google'}
              </Button>
              <FieldSeparator className="[&_[data-slot=field-separator-content]]:bg-card">
                ou
              </FieldSeparator>
              <form
                noValidate
                onSubmit={(event) => void sendLink(event)}
                className="flex flex-col gap-3"
              >
                <Field>
                  <FieldLabel htmlFor="sign-in-email">Seu e-mail</FieldLabel>
                  <Input
                    ref={emailInput}
                    id="sign-in-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    disabled={busy}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={
                      error ? 'sign-in-message' : 'sign-in-email-hint'
                    }
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>
                <Button
                  type="submit"
                  variant="outline"
                  className="min-h-11 w-full"
                  disabled={busy}
                  aria-busy={status === 'sending'}
                >
                  <EnvelopeSimple data-icon="inline-start" />
                  {status === 'sending' ? 'Enviando…' : 'Enviar link mágico'}
                  {status !== 'sending' && (
                    <ArrowRight data-icon="inline-end" />
                  )}
                </Button>
                <p
                  id="sign-in-email-hint"
                  className="mt-2 text-center text-xs whitespace-nowrap text-muted-foreground"
                >
                  Sem senha para lembrar
                </p>
              </form>
            </FieldGroup>
          )}
        </CardContent>
        {message && (
          <p
            id="sign-in-message"
            role="alert"
            className="px-6 pb-5 text-sm text-destructive"
          >
            {message}
          </p>
        )}
      </Card>
    </AuthFrame>
  );
}
