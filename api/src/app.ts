import express from 'express'
import { env } from './config/index.js'
import routes from './routes/index.js'
import { errorHandler, requestLogger } from './middlewares/index.js'

const app = express()

app.use(express.json())
app.use(requestLogger)

app.get('/', (_req, res) => {
	res.type('html').send(`<!doctype html>
<html lang="pt-BR">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Second Brain API</title>
		<style>
			:root {
				color-scheme: light;
				font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			}
			body {
				margin: 0;
				min-height: 100vh;
				display: grid;
				place-items: center;
				background: linear-gradient(135deg, #f6f7fb 0%, #eef4ff 100%);
				color: #111827;
			}
			main {
				width: min(720px, calc(100vw - 32px));
				background: rgba(255, 255, 255, 0.92);
				border: 1px solid #dbe4f0;
				border-radius: 20px;
				box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
				padding: 32px;
			}
			h1 {
				margin: 0 0 8px;
				font-size: clamp(28px, 4vw, 40px);
			}
			p {
				margin: 0 0 16px;
				line-height: 1.6;
				color: #475569;
			}
			.pill {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				padding: 8px 12px;
				border-radius: 999px;
				background: #ecfdf5;
				color: #166534;
				font-weight: 600;
				margin-bottom: 20px;
			}
			.dot {
				width: 10px;
				height: 10px;
				border-radius: 999px;
				background: #22c55e;
			}
			ul {
				margin: 20px 0 0;
				padding-left: 18px;
			}
			li {
				margin: 8px 0;
			}
			a {
				color: #2563eb;
				text-decoration: none;
			}
			a:hover {
				text-decoration: underline;
			}
			code {
				background: #eff6ff;
				border-radius: 6px;
				padding: 2px 6px;
			}
		</style>
	</head>
	<body>
		<main>
			<div class="pill"><span class="dot"></span>API online</div>
			<h1>Second Brain API</h1>
			<p>A aplicação está em execução e pronta para receber requests.</p>
			<p><strong>Ambiente:</strong> ${env.NODE_ENV}</p>
			<p><strong>Porta interna:</strong> ${env.PORT}</p>
			<ul>
				<li>Health check JSON: <a href="/api/health">/api/health</a></li>
				<li>Webhook de teste: <code>POST /api/webhooks/example</code></li>
			</ul>
		</main>
	</body>
</html>`)
})

app.use('/api', routes)

app.use(errorHandler)

export default app
