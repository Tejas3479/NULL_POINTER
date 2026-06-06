import { NextResponse, NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  
  // Intercept any relative requests for stackframe.js and return a mock JS content
  // to prevent the Next.js dev overlay from throwing SyntaxError: Unexpected token '<'
  if (url.pathname.endsWith('/stackframe.js')) {
    return new NextResponse('// Mock stackframe.js to resolve Turbopack dev overlay routing glitch', {
      headers: {
        'Content-Type': 'application/javascript',
      },
    });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match any path ending in stackframe.js
    '/:path*/stackframe.js',
  ],
};
