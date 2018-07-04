const { getName, getAlias } = require('guld-user')
const { getPass } = require('guld-pass')
const got = require('got')
const HOST = 'gitlab'
var client

async function getClient (user) {
  user = user || await getName()
  var pass = await getPass(`${user}/git/${HOST}`)
  return async function (url, params, method = 'GET') {
    if (url.indexOf('?') === -1) url = `${url}?`
    for (var p in params) {
      var uricomp = `${p}=${encodeURIComponent(params[p])}`
      url = `${url}${uricomp}&`
    }
    url = url.replace(/[&?]{1}$/, '')
    var resp = await got(url, {
      headers: {
        'Private-Token': pass.oauth
      },
      json: true,
      method: method
    })
    if (resp.statusCode === undefined || resp.statusCode < 300) return resp.body
    else throw new Error(`Gitlab API Error: ${resp.statusText || JSON.stringify(resp.body)}`)
  }
}

function parseRepo (repo) {
  var mainbranch
  if (repo.default_branch) mainbranch = repo.default_branch
  else mainbranch = repo.owner.username
  return {
    name: repo.name,
    privacy: repo.visibility,
    owner: repo.owner.username,
    mainbranch: mainbranch
  }
}

async function getNamespaceId (user) {
  user = user || await getName()
  client = client || await getClient(user)
  var glns = await client(
    `https://gitlab.com/api/v4/namespaces`,
    { search: user }
  )
  return glns[0].id
}

async function getUserId (user) {
  user = user || await getName()
  var hostuser = await getAlias(user, HOST) || user
  client = client || await getClient(user)
  var users = await client(
    `https://gitlab.com/api/v4/users`,
    {username: hostuser}
  )
  return users[0].id
}

async function getRepoId (rname, user) {
  user = user || await getName()
  client = client || await getClient(user)
  var userid = await getUserId()
  var url = `https://gitlab.com/api/v4/users/${userid}/projects`
  var repos = await client(url, {search: rname})
  if (repos && repos.length === 1 && repos[0].id) return repos[0].id
  else throw new Error('Repository not found.')
}

async function createRepo (rname, user, privacy = 'public', options = {}) {
  user = user || await getName()
  var hostuser = await getAlias(user, HOST) || user
  client = client || await getClient(user)
  // validate required field(s)
  if (typeof rname !== 'string' || rname.length === 0) throw new Error('Name is required to create repo.')
  var glnsid = await getNamespaceId(user)
  var url = `https://gitlab.com/api/v4/projects`
  var params = {
    name: rname,
    visibility: privacy,
    default_branch: hostuser, // eslint-disable-line camelcase
    namespace_id: glnsid // eslint-disable-line camelcase
  }
  var repo = await client(url, params, 'POST')
  return parseRepo(repo)
}

async function listRepos (user, query) {
  user = user || await getName()
  var params = {}
  client = client || await getClient(user)
  var userid = await getUserId()
  var url = `https://gitlab.com/api/v4/users/${userid}/projects`
  if (query) params = {search: query}
  var resp = await client(url, params)
  return resp.map(parseRepo)
}

async function deleteRepo (rname, user) {
  user = user || await getName()
  client = client || await getClient(user)
  // validate required field(s)
  if (typeof rname !== 'string' || rname.length === 0) throw new Error('Name is required to delete repo.')
  var rid = await getRepoId(rname, user)
  if (rid) {
    var url = `https://gitlab.com/api/v4/projects/${rid}`
    await client(url, {}, 'DELETE')
  } else throw new Error('Repository not found.')
}

module.exports = {
  getClient: getClient,
  createRepo: createRepo,
  listRepos: listRepos,
  deleteRepo: deleteRepo
}
