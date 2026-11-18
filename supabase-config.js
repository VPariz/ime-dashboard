/**
 * Configuração pública do Supabase para autenticação e leitura do dataset privado.
 * URL e Anon Key são desenhadas para uso público no frontend — a proteção real
 * dos dados é feita pelas regras RLS (Row Level Security) no Storage do Supabase.
 *
 * Passo a passo completo em SUPABASE_SETUP.md
 */
window.SUPABASE_CONFIG = {
  url: '',
  anonKey: '',
  bucket: 'ime-private',
  objectPath: 'data.json'
};
