import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Not logged in + not on login page → send to login
  if (!user && !path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // Already logged in + trying to see login → send to dev portal
  if (user && path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dev-portal', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
