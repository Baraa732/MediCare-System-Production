const token = process.env.RAILWAY_TOKEN;
const API = 'https://backboard.railway.com/graphql/v2';
const PROJECT = '50517ef9-d515-4f95-9993-622fd1d53bb8';
const ENV = 'bdae5825-b0ca-48e3-802a-bdf51b4b8005';

const res = await fetch(API, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `query($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status serviceId } }
      }
    }`,
    variables: {
      input: {
        projectId: PROJECT,
        environmentId: ENV,
        status: { in: ['SUCCESS', 'BUILDING', 'DEPLOYING', 'QUEUED', 'INITIALIZING', 'FAILED', 'CRASHED'] },
      },
      first: 50,
    },
  }),
});
const json = await res.json();
if (json.errors) {
  console.error(json.errors);
  process.exit(1);
}
const counts = {};
for (const { node } of json.data.deployments.edges) {
  counts[node.status] = (counts[node.status] || 0) + 1;
}
console.log(JSON.stringify(counts, null, 2));
console.log('total:', json.data.deployments.edges.length);
