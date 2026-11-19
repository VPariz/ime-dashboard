/**
 * Configuração pública do Supabase para autenticação e leitura do dataset privado.
 * URL e Anon Key são desenhadas para uso público no frontend — a proteção real
 * dos dados é feita pelas regras RLS (Row Level Security) no Storage do Supabase.
 *
 * Passo a passo completo em SUPABASE_SETUP.md
 */
window.SUPABASE_CONFIG = {
  url: 'https://mjquvlhxvwowhdwoykgq.supabase.co',
  anonKey: 'sb_publishable_-KVsy5FQ7x7ef6B7GKXhqg_wLZe45ia',
  bucket: 'ime-private',
  objectPath: 'turma_28/data.json'
};
