const { getName, getAlias } = require('guld-user')
const { getPass } = require('guld-pass')
const { getFS } = require('guld-fs')
const got = require('got')
const path = require('path')
const home = require('user-home')
const HOST = 'gitlab'
var client
var fs

async function getClient (user) {
  user = user || await getName()
  var passuser = process.env.PASSUSER || process.env.USER || user
  var pass = await getPass(`${passuser}/git/${HOST}`)
  return async function (url, params, method = 'GET') {
    var options = {
      headers: {
        'Private-Token': pass.oauth
      },
      json: true,
      method: method
    }
    if (method === 'GET') {
      if (url.indexOf('?') === -1) url = `${url}?`
      for (var p in params) {
        var uricomp = `${p}=${encodeURIComponent(params[p])}`
        url = `${url}${uricomp}&`
      }
      url = url.replace(/[&?]{1}$/, '')
    } else {
      options.body = params
    }
    var resp = await got(url, options)
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

async function addSSHKey (key) {
  var user = await getName()
  client = client || await getClient(user)
  fs = fs || await getFS()
  key = key || await fs.readFile(path.join(home, '.ssh', 'id_rsa.pub'), 'utf-8')
  var url = `https://gitlab.com/api/v4/user/keys`
  try {
    await client(
      url,
      {
        'key': key,
        'title': 'guld-key'
      },
      'POST'
    )
  } catch (e) {
    if (e.statusCode !== 400 || e.statusMessage !== 'Bad Request') throw e
  }
}

module.exports = {
  getClient: getClient,
  createRepo: createRepo,
  listRepos: listRepos,
  deleteRepo: deleteRepo,
  addSSHKey: addSSHKey,
  meta: {
    'url': 'gitlab.com',
    'oauth-required': true
  }
}
