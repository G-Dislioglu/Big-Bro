const express = require('express');
const router = express.Router();
const { version } = require('../../package.json');

const startedAt = new Date().toISOString();

function getGitSha() {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    'unknown'
  );
}

router.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'big-bro',
    version,
    git_sha: getGitSha(),
    build_time: process.env.BUILD_TIME || null,
    started_at: startedAt,
    railway: {
      deployment_id: process.env.RAILWAY_DEPLOYMENT_ID || null,
      replica_id: process.env.RAILWAY_REPLICA_ID || null,
      environment_id: process.env.RAILWAY_ENVIRONMENT_ID || null,
      service_id: process.env.RAILWAY_SERVICE_ID || null,
      git_branch: process.env.RAILWAY_GIT_BRANCH || null,
      git_commit_message: process.env.RAILWAY_GIT_COMMIT_MESSAGE || null
    }
  });
});

module.exports = router;
