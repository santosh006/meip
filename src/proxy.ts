import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Prevent Edge Middleware runtime crash if environment variables are missing on Vercel
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Middleware Error: Supabase environment variables are missing.');
    return NextResponse.json({ error: 'Authentication unavailable' }, { status: 503 });
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;

    // Redirect unauthenticated users to /login
    if (!user && path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user && path !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Redirect authenticated users away from /login
    if (user && path === '/login') {
      return NextResponse.redirect(new URL('/dev-portal', request.url));
    }

    return response;
  } catch (error) {
    console.error('Authentication failed:', error);
    return NextResponse.json({ error: 'Authentication unavailable' }, { status: 503 });
  }
}

export const config = {
  matcher: ['/', '/login', '/dev-portal/:path*', '/app/:path*', '/api/:path*'],
};
