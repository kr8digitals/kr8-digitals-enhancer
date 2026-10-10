// Small adapter that lets the original KR8 site code (written for react-router-dom)
// run on top of TanStack Router's history.
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";

type NavOpts = { replace?: boolean | undefined; state?: unknown };

export function useLocation() {
  const loc = useRouterState({ select: (s) => s.location });
  return {
    pathname: loc.pathname,
    search: loc.searchStr ?? "",
    hash: loc.hash ? `#${loc.hash}` : "",
    state: null as unknown,
    key: loc.href,
  };
}

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string | number, opts?: NavOpts) => {
      if (typeof to === "number") {
        router.history.go(to);
        return;
      }
      if (opts?.replace) router.history.replace(to);
      else router.history.push(to);
    },
    [router],
  );
}

export function useSearchParams(): [
  URLSearchParams,
  (next: Record<string, string> | URLSearchParams, opts?: NavOpts) => void,
] {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = useCallback(
    (next: Record<string, string> | URLSearchParams, opts?: NavOpts) => {
      const qs = new URLSearchParams(next as Record<string, string>).toString();
      navigate(pathname + (qs ? `?${qs}` : ""), opts);
    },
    [navigate, pathname],
  );
  return [params, set];
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  state?: unknown;
};

export function Link({ to, replace, state: _s, onClick, target, ...rest }: LinkProps) {
  const navigate = useNavigate();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (/^(https?:|mailto:|tel:)/.test(to)) return;
    e.preventDefault();
    navigate(to, { replace });
  };
  return <a href={to} target={target} onClick={handle} {...rest} />;
}

type NavLinkProps = Omit<LinkProps, "className" | "style" | "children"> & {
  className?: string | ((a: { isActive: boolean }) => string);
  style?: CSSProperties | ((a: { isActive: boolean }) => CSSProperties);
  children?: ReactNode | ((a: { isActive: boolean }) => ReactNode);
  end?: boolean;
};

export function NavLink({ className, style, children, end, to, ...rest }: NavLinkProps) {
  const { pathname } = useLocation();
  const path = to.split("?")[0];
  const isActive = end || path === "/" ? pathname === path : pathname === path || pathname.startsWith(path + "/");
  const a = { isActive };
  return (
    <Link
      to={to}
      {...rest}
      className={typeof className === "function" ? className(a) : className}
      style={typeof style === "function" ? style(a) : style}
    >
      {typeof children === "function" ? children(a) : children}
    </Link>
  );
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}

const OutletCtx = createContext<ReactNode>(null);
export function Outlet() {
  return <>{useContext(OutletCtx)}</>;
}

type RouteProps = { path?: string; element?: ReactNode; children?: ReactNode };
export function Route(_: RouteProps): ReactElement | null {
  return null;
}

function matchRoutes(children: ReactNode, pathname: string): ReactNode | undefined {
  let fallback: ReactNode | undefined;
  for (const child of Children.toArray(children)) {
    if (!isValidElement<RouteProps>(child)) continue;
    const { path, element, children: nested } = child.props;
    if (!path) {
      const inner = matchRoutes(nested, pathname);
      if (inner !== undefined) return <OutletCtx.Provider value={inner}>{element}</OutletCtx.Provider>;
      continue;
    }
    if (path === "*") {
      fallback = element;
      continue;
    }
    const norm = pathname.replace(/\/+$/, "") || "/";
    if (path === norm) return element;
    if (path.includes(':')) {
      const pathParts = path.split('/').filter(Boolean);
      const normParts = norm.split('/').filter(Boolean);
      if (pathParts.length === normParts.length) {
        let match = true;
        for (let i = 0; i < pathParts.length; i++) {
          if (pathParts[i].startsWith(':')) continue;
          if (pathParts[i] !== normParts[i]) { match = false; break; }
        }
        if (match) return element;
      }
    }
    if (path === '/go/:slug' && norm.startsWith('/go/')) return element;
  }
  return fallback;
}

export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <>{matchRoutes(children, pathname) ?? null}</>;
}

export function BrowserRouter({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
