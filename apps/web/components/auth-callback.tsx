'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, WarningCircle } from '@phosphor-icons/react';
import { AuthFrame, AuthPending } from '@/components/sign-in-screen';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { authErrorMessage, SupabaseAuth, type AuthPort } from '@/lib/auth';

/** Finishes the PKCE exchange started by Google or the magic link. */
export function AuthCallback({
  auth: provided,
  navigate = (path) => globalThis.location.replace(path),
}: {
  auth?: AuthPort;
  navigate?: (path: string) => void;
}) {
  const [auth] = useState<AuthPort>(() => provided ?? new SupabaseAuth());
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    auth.completeRedirect(globalThis.location.href).then(
      () => {
        if (active) navigate('/');
      },
      (caught: unknown) => {
        if (active) setError(authErrorMessage(caught));
      },
    );
    return () => {
      active = false;
    };
    // Runs once per page load: the code can only be exchanged a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  if (!error) return <AuthPending message="Confirmando seu acesso…" />;
  return (
    <AuthFrame>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-3xl uppercase">
            <h1>Não deu para entrar</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="flex items-start gap-3 text-sm">
            <WarningCircle
              className="mt-0.5 shrink-0 text-destructive"
              weight="fill"
            />
            {error}
          </p>
        </CardContent>
        <CardFooter>
          <Button className="min-h-11 w-full" onClick={() => navigate('/')}>
            Voltar para a entrada
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    </AuthFrame>
  );
}
