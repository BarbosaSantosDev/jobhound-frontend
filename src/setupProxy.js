// Proxy do dev server (npm start): o frontend chama /api/... na própria origem
// e o CRA encaminha para o backend. Sem CORS e funciona de qualquer host
// (localhost, 127.0.0.1, IP da rede). Só vale em desenvolvimento; o build de
// produção usa REACT_APP_API_URL (ver src/api/client.js).
const { createProxyMiddleware } = require("http-proxy-middleware");

const target = process.env.JOBHOUND_API_PROXY || "http://localhost:8000";

module.exports = function setupProxy(app) {
  app.use(createProxyMiddleware("/api", { target, changeOrigin: true, logLevel: "warn" }));
};
