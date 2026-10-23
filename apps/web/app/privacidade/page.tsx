import { ContactEmail, LEGAL_INFO, LegalPage } from '@/components/legal-page';

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
          Controlador: {LEGAL_INFO.company}, CNPJ {LEGAL_INFO.cnpj}, responsável
          pelo Footebas ({LEGAL_INFO.site}). O jogo é desenvolvido e operado por{' '}
          {LEGAL_INFO.operator}, que também é o encarregado pelo tratamento de
          dados pessoais (DPO). Contato para qualquer assunto de privacidade:{' '}
          <ContactEmail />.
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

      <section aria-labelledby="p-google">
        <h2 id="p-google">3. Login com Google</h2>
        <p>
          Se você entra com o Google, recebemos apenas o que o Google informa
          para identificar a conta: nome, endereço de e-mail e foto de perfil
          (escopos básicos <em>openid</em>, <em>email</em> e <em>profile</em>).
          Não pedimos acesso a Gmail, Drive, contatos, agenda ou qualquer outro
          dado da sua conta Google.
        </p>
        <ul>
          <li>
            Usamos esses dados somente para criar e manter o seu login, mostrar
            o seu nome e a sua foto na tela inicial do jogo e falar com você
            sobre a sua conta ou compra.
          </li>
          <li>
            Eles ficam guardados no Supabase, nosso provedor de autenticação,
            enquanto a conta existir, e são apagados quando você pede a exclusão
            da conta.
          </li>
          <li>
            Não vendemos, não alugamos e não compartilhamos dados do Google com
            terceiros, não os usamos para publicidade nem para treinar modelos
            de inteligência artificial, e eles nunca aparecem no ranking
            público.
          </li>
        </ul>
        <p>
          O uso de informações recebidas das APIs do Google segue a Política de
          dados do usuário dos serviços de API do Google, incluindo os
          requisitos de uso limitado. Você pode revogar o acesso do Footebas a
          qualquer momento em myaccount.google.com/permissions.
        </p>
      </section>

      <section aria-labelledby="p-finalidade">
        <h2 id="p-finalidade">4. Para quê e com que base legal</h2>
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
        <h2 id="p-compartilhamento">5. Com quem compartilhamos</h2>
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
        <h2 id="p-retencao">6. Por quanto tempo guardamos</h2>
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
        <h2 id="p-direitos">7. Seus direitos</h2>
        <p>
          Você pode pedir confirmação do tratamento, acesso, correção,
          anonimização, portabilidade, informação sobre compartilhamentos,
          revogação de consentimento e exclusão dos seus dados. Carreiras podem
          ser excluídas dentro do jogo; para excluir a conta inteira, escreva
          para <ContactEmail />. Respondemos em até 15 dias. Se não ficar
          satisfeito, você pode reclamar à Autoridade Nacional de Proteção de
          Dados (ANPD).
        </p>
      </section>

      <section aria-labelledby="p-cookies">
        <h2 id="p-cookies">8. Cookies e armazenamento local</h2>
        <p>
          Usamos apenas armazenamento essencial: a sessão de login (mantida pelo
          Supabase no navegador), preferências do jogo como som e escalações
          salvas (armazenamento local do seu aparelho) e o cache do aplicativo
          para funcionar offline. Não usamos cookies de publicidade nem
          rastreamento entre sites.
        </p>
      </section>

      <section aria-labelledby="p-seguranca">
        <h2 id="p-seguranca">9. Segurança</h2>
        <p>
          Dados trafegam criptografados (HTTPS), o acesso ao banco é restrito
          aos nossos serviços e as notificações de pagamento são verificadas por
          assinatura. Nenhum sistema é infalível; se houver incidente que afete
          você, avisaremos conforme a LGPD.
        </p>
      </section>

      <section aria-labelledby="p-mudancas">
        <h2 id="p-mudancas">10. Mudanças nesta política</h2>
        <p>
          Atualizações são publicadas nesta página com a data revisada; mudanças
          relevantes são avisadas no jogo ou por e-mail.
        </p>
      </section>
    </LegalPage>
  );
}
