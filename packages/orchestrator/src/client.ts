import { Client, Connection } from "@temporalio/client";
import { env } from "./env.js";

export function clientConnectionOptions(): {
  address: string;
  namespace: string;
} {
  return {
    address: env.temporalAddress,
    namespace: env.temporalNamespace
  };
}

export async function createClient(): Promise<{
  client: Client;
  connection: Connection;
}> {
  const opts = clientConnectionOptions();
  const connection = await Connection.connect({ address: opts.address });
  const client = new Client({ connection, namespace: opts.namespace });
  return { client, connection };
}
