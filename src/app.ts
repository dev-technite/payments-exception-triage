import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { AppDependencies } from "./types/app.types";

const INVALID_JSON_MESSAGE = "body must be valid JSON";

export function buildApp({ service }: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler(handleError);

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/exceptions", async (request, reply) => {
    const result = await service.submit(request.body);
    if (!result.ok) {
      return reply.code(422).send({ errors: result.errors });
    }
    return reply.code(201).send(result.case);
  });

  app.get<{ Params: { id: string } }>("/exceptions/:id", async (request, reply) => {
    const found = service.getCase(request.params.id);
    if (!found) {
      return reply.code(404).send({ error: "case not found" });
    }
    return found;
  });

  app.get("/exceptions", async () => service.listCases());

  return app;
}

function handleError(error: FastifyError, _request: FastifyRequest, reply: FastifyReply): void {
  if (isBodyParseError(error)) {
    reply.code(422).send({ errors: [{ field: "body", message: INVALID_JSON_MESSAGE }] });
    return;
  }
  reply.send(error);
}

function isBodyParseError(error: FastifyError): boolean {
  return error.statusCode === 400 && error.code.startsWith("FST_ERR_CTP_");
}
