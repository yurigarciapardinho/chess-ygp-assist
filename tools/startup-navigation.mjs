const certificateCode=/\b(?:SEC_ERROR_[A-Z_]+|MOZILLA_PKIX_ERROR_[A-Z_]+|SSL_ERROR_(?:BAD_CERT_DOMAIN|UNKNOWN))\b/;

export async function navigateAtStartup(navigate,notify=console.error) {
  try {
    await navigate();
    return true;
  } catch(error) {
    const code=String(error?.message||error).match(certificateCode)?.[0];
    if(!code)throw error;
    notify([
      'Navegação bloqueada: '+code,
      'A conexão HTTPS foi recusada pelo navegador. Confira o certificado no aviso de segurança.',
      'A janela permanece aberta para inspecionar o aviso de segurança.',
      'Se a rede usa inspeção HTTPS, solicite à TI a CA oficial e as instruções para o perfil do navegador.',
      'A validação HTTPS continua ativa. Após corrigir a conexão, recarregue a página.',
    ].join('\n'));
    return false;
  }
}
