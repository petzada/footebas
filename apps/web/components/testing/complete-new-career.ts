import { fireEvent, screen } from '@testing-library/react';

export interface NewCareerAnswers {
  club?: string;
  coach?: string;
  nationalityQuery?: string;
  nationality?: string;
  avatar?: number;
  personality?: string;
  careerName?: string;
}

const continueButton = () =>
  screen.getByRole('button', { name: /^continuar$/i });

/**
 * Walks the five New Career steps (modo → universo → clube → treinador →
 * nome) from the wizard's first step and submits it.
 */
export async function completeNewCareer(answers: NewCareerAnswers = {}) {
  await screen.findByRole('heading', { name: /como você quer jogar/i });
  fireEvent.click(continueButton());
  await screen.findByRole('heading', { name: /onde vai ser a sua carreira/i });
  fireEvent.click(continueButton());
  await screen.findByRole('heading', { name: /escolha seu clube/i });
  fireEvent.click(
    screen.getByRole('radio', { name: new RegExp(answers.club ?? 'Flamengo') }),
  );
  fireEvent.click(continueButton());
  await screen.findByRole('heading', { name: /quem é o treinador/i });
  fireEvent.change(screen.getByLabelText(/nome do treinador/i), {
    target: { value: answers.coach ?? 'Ana' },
  });
  if (answers.nationalityQuery)
    fireEvent.change(screen.getByLabelText(/buscar país/i), {
      target: { value: answers.nationalityQuery },
    });
  if (answers.nationality)
    fireEvent.change(screen.getByRole('listbox', { name: /^país$/i }), {
      target: { value: answers.nationality },
    });
  if (answers.avatar)
    fireEvent.click(
      screen.getByRole('radio', { name: `Avatar ${answers.avatar}` }),
    );
  fireEvent.click(
    screen.getByRole('radio', {
      name: new RegExp(`^${answers.personality ?? 'Estrategista'}`),
    }),
  );
  fireEvent.click(continueButton());
  await screen.findByRole('heading', { name: /dê um nome à carreira/i });
  if (answers.careerName !== undefined)
    fireEvent.change(screen.getByLabelText(/nome da carreira/i), {
      target: { value: answers.careerName },
    });
  fireEvent.click(screen.getByRole('button', { name: /começar carreira/i }));
}
