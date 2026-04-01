# 🚀 Advanced Usage

---

## 🧠 Dynamic Limits

```ts
rules: [
  {
    path: '/api',
    window: 60,
    max: (ctx) => ctx.user?.premium ? 1000 : 100
  }
]
```

---

## 🔑 Custom Keys

```ts
key: (ctx) => ctx.user.id + ':' + ctx.path
```

---

## 🧩 Multi-layer Limiting

Combine:

* IP limiting
* user limiting
* route limiting

---

## ⚙️ Production Setup

* Use Redis cluster
* Enable failOpen
* Use proxy + app-level limiter

---

## ⚡ Performance Tips

* Avoid heavy key functions
* precompile rules
* reuse limiter instance

---

## 🐞 Debugging

Enable debug logs:

```ts
debug: true
```

---

## 🔒 Best Practices

* Use proxy + app limiter together
* avoid fixed window
* monitor Redis latency
