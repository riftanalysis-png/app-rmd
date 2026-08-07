import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';

const isStaticAsset = (pathname: string) => {
  return pathname.startsWith('/_next/') || pathname.startsWith('/images/') || /\.(?:png|jpe?g|gif|svg|ico|webp|avif|css|js|txt|json|map)$/i.test(pathname);
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  if (isDashboardRoute && !isStaticAsset(pathname) && !session) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/Login';
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
