import type { RateLimitRule, RateLimitContext, RateLimitDefaultConfig } from '../types/index.js';

export interface CompiledPolicies {
  exact: Map<string, RateLimitRule>;
  prefix: Array<{ prefix: string; rule: RateLimitRule }>;
  dynamic: Array<RateLimitRule>;
}

export function compilePolicies(policies?: RateLimitRule[]): CompiledPolicies {
  const result: CompiledPolicies = {
    exact: new Map(),
    prefix: [],
    dynamic: []
  };

  if (!policies || !Array.isArray(policies)) {
    return result;
  }

  for (const rule of policies) {
    if (rule.match || rule.path instanceof RegExp) {
      result.dynamic.push(rule);
    } else if (typeof rule.path === 'string') {
      result.exact.set(rule.path, rule);
    } else if (typeof rule.prefix === 'string') {
      result.prefix.push({ prefix: rule.prefix, rule });
    } else {
      result.dynamic.push(rule);
    }
  }

  // Sort prefixes by length descending for specificity (longest prefix matches first)
  result.prefix.sort((a, b) => b.prefix.length - a.prefix.length);

  return result;
}

export function resolvePolicy(
  ctx: RateLimitContext,
  compiledPolicies: CompiledPolicies,
  defaultRule: RateLimitDefaultConfig
): RateLimitRule {
  const path = ctx.route || ctx.path.replace(/\d+/g, ':id');
  const method = ctx.method.toUpperCase();

  // 1. Try exact match
  const exact = compiledPolicies.exact.get(path);
  if (exact && (!exact.method || exact.method.toUpperCase() === method)) {
    return exact;
  }

  // 2. Try prefix matches
  for (const item of compiledPolicies.prefix) {
    if (path.startsWith(item.prefix) && (!item.rule.method || item.rule.method.toUpperCase() === method)) {
      return item.rule;
    }
  }

  // 3. Try dynamic matches
  for (const rule of compiledPolicies.dynamic) {
    if (rule.method && rule.method.toUpperCase() !== method) continue;

    if (rule.match && rule.match(ctx)) {
      return rule;
    }

    if (rule.path instanceof RegExp && rule.path.test(path)) {
      return rule;
    }
  }

  // Fallback to default
  return defaultRule as RateLimitRule;
}
