# TitanPaaS Multi-Node Cluster Orchestration (Docker Swarm)

This guide details the multi-node clustering architecture, setup, management, and deployment workflows supported by TitanPaaS using Docker Swarm.

---

## 1. Architecture Overview

TitanPaaS supports multi-server clustering allowing applications to run across multiple worker servers coordinated by a central manager:

- **Central Manager (Control Plane):** Runs the TitanPaaS API, database, and Redis. It orchestrates Swarm services, tracks cluster health, and issues join tokens for new nodes.
- **Worker Nodes (Data Plane):** Run application workloads and container replicas. Workers do not access the cluster state directly, preserving security and isolation.
- **Routing Mesh & Overlay Network:** Swarm provides an ingress routing mesh and an attachable overlay network (`titan-overlay`). Incoming HTTP/HTTPS traffic received by Traefik is routed across nodes to the corresponding container replicas seamlessly.

---

## 2. Cluster Prerequisites and Ports

To connect multiple nodes, ensure the following network ports are open between the manager and worker servers:

- **TCP port 2377:** Cluster management communications.
- **TCP and UDP port 7946:** Communication among nodes (container network discovery).
- **UDP port 4789:** Overlay network traffic (VXLAN data plane).

---

## 3. Initializing the Cluster

To initialize Docker Swarm on the central TitanPaaS manager server:

### Via API Endpoint
```http
POST /cluster/init
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "advertiseAddr": "192.168.1.100",
  "defaultAddrPool": "10.10.0.0/16",
  "subnetSize": 24
}
```

### Via Docker CLI Directly
```bash
docker swarm init --advertise-addr 192.168.1.100
docker network create --driver overlay --attachable titan-overlay
```

---

## 4. Joining Worker Nodes

To retrieve join tokens and commands:

### Via API Endpoint
```http
GET /cluster/join-tokens
Authorization: Bearer <TOKEN>
```

Example response:
```json
{
  "workerToken": "SWMTKN-1-xxxxxxxxxxxxxxxxxxxx",
  "managerToken": "SWMTKN-1-yyyyyyyyyyyyyyyyyyyy",
  "listenAddr": "192.168.1.100:2377",
  "workerJoinCommand": "docker swarm join --token SWMTKN-1-xxxxxxxxxxxxxxxxxxxx 192.168.1.100:2377",
  "managerJoinCommand": "docker swarm join --token SWMTKN-1-yyyyyyyyyyyyyyyyyyyy 192.168.1.100:2377"
}
```

On any new VPS or dedicated server with Docker installed, run the worker join command:
```bash
docker swarm join --token SWMTKN-1-xxxxxxxxxxxxxxxxxxxx 192.168.1.100:2377
```

---

## 5. Cluster Management API

The `ClusterController` provides comprehensive management endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/cluster/status` | Swarm cluster status, role, and node counters |
| `POST` | `/cluster/init` | Initialize Swarm manager on current server |
| `GET` | `/cluster/join-tokens` | Get join tokens and ready-to-run join commands |
| `GET` | `/cluster/nodes` | List all connected nodes and statuses |
| `GET` | `/cluster/nodes/:id` | Inspect specific node details and engine specs |
| `PATCH` | `/cluster/nodes/:id` | Update node availability (active, pause, drain) and labels |
| `DELETE` | `/cluster/nodes/:id` | Remove a worker node from the cluster |
| `POST` | `/cluster/leave` | Leave cluster (supports `?force=true`) |
| `POST` | `/cluster/services` | Deploy or update a replicated service across workers |
| `DELETE` | `/cluster/services/:name` | Remove a distributed Swarm service |

---

## 6. Node Maintenance (Drain Mode)

Before performing maintenance or decommissioning a worker server, drain it to migrate running containers gracefully to other active workers:

```http
PATCH /cluster/nodes/worker-node-id
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "availability": "drain"
}
```

Once maintenance is complete, restore the node to `active`:

```http
PATCH /cluster/nodes/worker-node-id
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "availability": "active"
}
```

---

## 7. Project Distributed Deployment

Projects can configure cluster deployment directly on the `Project` entity:

- `isClusterEnabled`: Set to `true` to deploy using Docker Swarm services instead of standalone containers.
- `clusterReplicas`: Number of container instances distributed across workers (e.g. `3`).
- `clusterPlacement`: Placement constraints (e.g. `["node.role == worker"]`).

When enabled, TitanPaaS uses `docker-pipeline.service.ts` to deploy to Swarm with rolling updates, zero downtime, and automatic multi-host routing.
