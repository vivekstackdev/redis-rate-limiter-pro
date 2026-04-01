
// Route context for rule matching
export interface RouteContext {
  path: string;
  method?: string;
  headers?: Record<string, any>;
}

export interface CompiledRules {
  exact: Map<string, any>;
  prefix: Array<{ prefix: string; config: any }>;
  dynamic: Array<any>;
  fallback: any;
}

// Precompile rules for performance
export const compileRules = (rules: any[] = [], fallback: any): CompiledRules => {
  const exact = new Map();
  const prefix: any[] = [];
  const dynamic: any[] = [];

  for (const rule of rules) {
    if (rule.path) {
      exact.set(rule.path, rule);
    } else if (rule.prefix) {
      prefix.push({ prefix: rule.prefix, config: rule });
    } else if (rule.match) {
      dynamic.push(rule);
    }
  }

  // Sort prefix rules by length (longest first) for more specific matching
  prefix.sort((a, b) => b.prefix.length - a.prefix.length);

  return { exact, prefix, dynamic, fallback };
};

export const resolveCompiledRule = (ctx: RouteContext, compiled: CompiledRules) => {
  const path = ctx.path;

  if (compiled.exact.has(path)) {
    return compiled.exact.get(path);
  }

  for (const p of compiled.prefix) {
    if (path.startsWith(p.prefix)) {
      return p.config;
    }
  }

  for (const rule of compiled.dynamic) {
    if (rule.match(ctx)) {
      return rule;
    }
  }

  return compiled.fallback;
};
