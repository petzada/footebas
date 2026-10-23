import { LEGAL_PLACEHOLDER, LegalPage } from '@/components/legal-page';

export const metadata = {
  title: 'Política de privacidade — Footebas',
  description:
    'Quais dados o Footebas coleta, para quê, por quanto tempo e quais são os seus direitos (LGPD).',
};

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de privacidade"
      intro="Explicamos aqui, em linguagem simples, quais dados pessoais o Footebas trata, por quê e quais são os seus direitos segundo a Lei Geral de Proteção de Dados (Lei 13.709/2018)."
    >
      <section aria-labelledby="p-controlador">
        <h2 id="p-controlador">1. Quem é responsável</h2>
        <p>
          Controlador: {LEGAL_PLACEHOLDER.company}, CNPJ{' '}
          {LEGAL_PLACEHOLDER.cnpj}, {LEGAL_PLACEHOLDER.address}. Encarregado de
          dados (DPO): {LEGAL_PLACEHOLDER.dpo}. Contato:{' '}
          {LEGAL_PLACEHOLDER.email}.
        </p>
      </section>

      <section aria-labelledby="p-dados">
        <h2 id="p-dados">2. Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Conta:</strong> e-mail; e, no login com Google, nome e foto
            de perfil fornecidos pelo Google. A autenticação é feita pelo
            Supabase, nosso provedor de identidade.
          </li>
          <li>
            <strong>Jogo:</strong> carreiras, nome de treinador, escolhas de
            jogo e conquistas. São dados de jogo, não de identificação, mas
            ficam vinculados à sua conta.
          </li>
          <li>
            <strong>Pagamento:</strong> ao comprar a licença, registramos o
            pedido (valor, data, status) e a confirmação enviada pela
            AbacatePay. Removemos CPF, nome e dados bancários do pagador antes
            de guardar qualquer notificação de pagamento. Não temos acesso à sua
            conta bancária.
          </li>
          <li>
            <strong>Técnicos:</strong> endereço IP, navegador e registros de
            erro, usados para segurança, limite de requisições e correção de
            falhas.
          </li>
        </ul>
        <p>Não coletamos localização precisa, contatos nem dados sensíveis.</p>
      </section>

      <section aria-labelledby="p-finalidade">
        <h2 id="p-finalidade">3. Para quê e com que base legal</h2>
        <ul>
          <li>
            Manter sua conta e salvar suas carreiras —{' '}
            <em>execução de contrato</em>.
          </li>
          <li>
            Processar o pagamento da licença e o reembolso —{' '}
            <em>execução de contrato</em> e <em>obrigação legal</em> (registros
            fiscais).
          </li>
          <li>
            Publicar o ranking com o nome de treinador —{' '}
            <em>execução de contrato</em> (é parte do jogo) e{' '}
            <em>legítimo interesse</em>; nenhum dado pessoal direto é exibido.
          </li>
          <li>
            Segurança, prevenção a abusos e correção de falhas —{' '}
            <em>legítimo interesse</em>.
          </li>
          <li>
            Enviar o link mágico de acesso e avisos essenciais do serviço —{' '}
            <em>execução de contrato</em>. Não enviamos marketing sem seu
            consentimento.
          </li>
        </ul>
      </section>

      <section aria-labelledby="p-compartilhamento">
        <h2 id="p-compartilhamento">4. Com quem compartilhamos</h2>
        <p>
          <strong>Não vendemos nem alugamos dados pessoais.</strong>{' '}
          Compartilhamos só com operadores necessários ao serviço: Supabase
          (autenticação e banco de dados), Cloudflare (hospedagem e rede),
          AbacatePay (pagamento PIX) e o provedor de e-mail transacional. Alguns
          deles processam dados fora do Brasil, com salvaguardas contratuais.
          Também podemos compartilhar por ordem legal.
        </p>
      </section>

      <section aria-labelledby="p-retencao">
        <h2 id="p-retencao">5. Por quanto tempo guardamos</h2>
        <ul>
          <li>Conta e carreiras: enquanto a conta existir.</li>
          <li>
            Registros de pagamento: pelo prazo exigido pela legislação fiscal
            (em regra, 5 anos).
          </li>
          <li>Registros técnicos: até 90 dias, salvo investigação de abuso.</li>
          <li>
            Conquistas no ranking: ficam, com o nome de treinador, mesmo após a
            carreira ser excluída; peça a remoção se quiser sair do ranking.
          </li>
        </ul>
      </section>

      <section aria-labelledby="p-direitos">
        <h2 id="p-direitos">6. Seus direitos</h2>
        <p>
          Você pode pedir confirmação do tratamento, acesso, correção,
          anonimização, portabilidade, informação sobre compartilhamentos,
          revogação de consentimento e exclusão dos seus dados. Carreiras podem
          ser excluídas dentro do jogo; para excluir a conta inteira, escreva
          para {LEGAL_PLACEHOLDER.email}. Respondemos em até 15 dias. Se não
          ficar satisfeito, você pode reclamar à Autoridade Nacional de Proteção
          de Dados (ANPD).
        </p>
      </section>

      <section aria-labelledby="p-cookies">
        <h2 id="p-cookies">7. Cookies e armazenamento local</h2>
        <p>
          Usamos apenas armazenamento essencial: a sessão de login (mantida pelo
          Supabase no navegador), preferências do jogo como som e escalações
          salvas (armazenamento local do seu aparelho) e o cache do aplicativo
          para funcionar offline. Não usamos cookies de publicidade nem
          rastreamento entre sites.
        </p>
      </section>

      <section aria-labelledby="p-seguranca">
        <h2 id="p-seguranca">8. Segurança</h2>
        <p>
          Dados trafegam criptografados (HTTPS), o acesso ao banco é restrito
          aos nossos serviços e as notificações de pagamento são verificadas por
          assinatura. Nenhum sistema é infalível; se houver incidente que afete
          você, avisaremos conforme a LGPD.
        </p>
      </section>

      <section aria-labelledby="p-mudancas">
        <h2 id="p-mudancas">9. Mudanças nesta política</h2>
        <p>
          Atualizações são publicadas nesta página com a data revisada; mudanças
          relevantes são avisadas no jogo ou por e-mail.
        </p>
      </section>
    </LegalPage>
  );
}
