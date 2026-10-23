import { LEGAL_PLACEHOLDER, LegalPage } from '@/components/legal-page';

export const metadata = {
  title: 'Termos de uso — Footebas',
  description:
    'Condições de uso do Footebas: conta, licença única, reembolso e ranking público.',
};

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de uso"
      intro="Estas condições regulam o uso do Footebas, um jogo de gerenciamento de futebol oferecido pela web. Ao criar uma conta você concorda com elas."
    >
      <section aria-labelledby="t-servico">
        <h2 id="t-servico">1. O serviço</h2>
        <p>
          O Footebas é um jogo de simulação (manager de futebol) acessível por
          navegador e instalável como aplicativo web (PWA). As partidas são
          simuladas em nossos servidores; o resultado é determinado pelo motor
          do jogo e não pode ser alterado por quem joga. Clubes, atletas e
          competições são representações de jogo, com emblemas e avatares
          gerados pelo próprio Footebas.
        </p>
        <p>
          O serviço é oferecido por {LEGAL_PLACEHOLDER.company}, inscrita no
          CNPJ {LEGAL_PLACEHOLDER.cnpj}, com sede em {LEGAL_PLACEHOLDER.address}{' '}
          (&quot;Footebas&quot;, &quot;nós&quot;).
        </p>
      </section>

      <section aria-labelledby="t-conta">
        <h2 id="t-conta">2. Conta</h2>
        <p>
          Para jogar é preciso uma conta, criada com login do Google ou com um
          link mágico enviado ao seu e-mail. Você é responsável por manter o
          acesso ao seu e-mail e por tudo o que acontece na sua conta. Uma
          pessoa, uma conta. É preciso ter 18 anos ou mais, ou autorização de
          quem é responsável por você.
        </p>
        <p>
          O nome de treinador escolhido em cada carreira é público quando a
          carreira pontua no ranking (seção 5). Não use nomes ofensivos, que se
          passem por outra pessoa ou que exponham dados pessoais.
        </p>
      </section>

      <section aria-labelledby="t-licenca">
        <h2 id="t-licenca">3. Plano grátis e licença única</h2>
        <p>
          O plano grátis permite uma carreira por conta, começando em um clube
          das divisões de baixo. A licença única, paga uma só vez via PIX,
          libera até cinco carreiras simultâneas e a escolha de qualquer clube
          ao iniciar. A licença não dá vantagem esportiva dentro do jogo nem
          altera a simulação.
        </p>
        <ul>
          <li>
            O preço vigente é exibido antes do pagamento, em reais, e pode mudar
            para novas compras; a licença já adquirida permanece válida para a
            edição comprada.
          </li>
          <li>
            O pagamento é processado pela AbacatePay (PIX). Não guardamos dados
            bancários: recebemos apenas a confirmação do pagamento.
          </li>
          <li>
            A licença é pessoal, vinculada à sua conta, e não pode ser
            transferida ou revendida.
          </li>
        </ul>
      </section>

      <section aria-labelledby="t-reembolso">
        <h2 id="t-reembolso">4. Arrependimento e reembolso</h2>
        <p>
          Como a compra é feita fora do estabelecimento comercial, você pode
          desistir em até <strong>7 dias corridos</strong> a partir do
          pagamento, sem precisar justificar (Código de Defesa do Consumidor,
          art. 49). O pedido é feito na tela Perfil, com um toque em &quot;Pedir
          reembolso&quot;, e o valor integral é devolvido à mesma chave PIX de
          origem. Com o estorno confirmado, a conta volta ao plano grátis:
          carreiras além do limite ficam bloqueadas, não apagadas.
        </p>
        <p>
          Após os 7 dias o reembolso só é feito em caso de falha do serviço
          imputável a nós. Fale com {LEGAL_PLACEHOLDER.email}.
        </p>
      </section>

      <section aria-labelledby="t-ranking">
        <h2 id="t-ranking">5. Ranking público</h2>
        <p>
          O ranking de treinadores é público e lista o nome de treinador da
          carreira, a posição e os pontos, calculados somente a partir de
          conquistas validadas pelos nossos servidores. Nenhum dado pessoal
          (e-mail, nome real, foto) aparece no ranking. Não há prêmio em
          dinheiro: o ranking é reconhecimento. Podemos remover do ranking
          conquistas obtidas por exploração de falhas ou automação.
        </p>
      </section>

      <section aria-labelledby="t-uso">
        <h2 id="t-uso">6. Uso aceitável</h2>
        <ul>
          <li>
            Não use bots, scripts ou múltiplas contas para obter vantagem.
          </li>
          <li>
            Não tente alterar resultados, explorar falhas ou acessar dados de
            outras pessoas.
          </li>
          <li>Não copie ou redistribua o jogo ou seus recursos.</li>
        </ul>
        <p>
          Podemos suspender ou encerrar contas que violem estes termos. Você
          pode encerrar sua conta a qualquer momento pelo e-mail de contato; os
          dados são tratados conforme a Política de privacidade.
        </p>
      </section>

      <section aria-labelledby="t-disponibilidade">
        <h2 id="t-disponibilidade">7. Disponibilidade e mudanças</h2>
        <p>
          O Footebas está em desenvolvimento contínuo. Fazemos o possível para
          manter o serviço no ar e as carreiras salvas, mas não garantimos
          disponibilidade ininterrupta. Regras do jogo, conteúdo e estes termos
          podem mudar; mudanças relevantes são avisadas no jogo ou por e-mail.
        </p>
      </section>

      <section aria-labelledby="t-contato">
        <h2 id="t-contato">8. Contato e foro</h2>
        <p>
          Dúvidas e pedidos: {LEGAL_PLACEHOLDER.email}. Estes termos seguem a
          legislação brasileira; para questões de consumo vale o foro do seu
          domicílio.
        </p>
      </section>
    </LegalPage>
  );
}
