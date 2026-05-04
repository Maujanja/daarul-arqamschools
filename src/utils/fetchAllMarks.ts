import { supabase } from '@/integrations/supabase/client';

/**
 * Paginated fetch for marks via the secure data-query edge function.
 *
 * Background: PostgREST enforces a hard `max-rows` cap (default 1000) regardless
 * of any `.range()` value. A single call with `range { from: 0, to: 9999 }` will
 * therefore silently truncate large class/term result sets, which causes the
 * Annual Report to drop subjects (when only a subset of subjects appears in the
 * first 1000 rows) and to under-count candidates per subject.
 *
 * This helper paginates in 1000-row chunks and concatenates every page.
 */
export async function fetchAllMarksPaginated(params: {
  userRole: string;
  userId: string;
  filters: Record<string, unknown>;
  pageSize?: number;
}): Promise<any[]> {
  const pageSize = params.pageSize ?? 1000;
  const all: any[] = [];
  let page = 0;
  // Hard safety cap to avoid infinite loops in pathological cases.
  const maxPages = 50;

  while (page < maxPages) {
    const { data, error } = await supabase.functions.invoke('data-query', {
      body: {
        table: 'marks',
        userRole: params.userRole,
        userId: params.userId,
        filters: params.filters,
        range: { from: page * pageSize, to: (page + 1) * pageSize - 1 },
        orderBy: { column: 'id', ascending: true },
      },
    });

    if (error) {
      console.error('fetchAllMarksPaginated error:', error);
      break;
    }

    const pageRows: any[] = data?.success ? (data.data || []) : [];
    all.push(...pageRows);
    if (pageRows.length < pageSize) break; // last page
    page += 1;
  }

  return all;
}