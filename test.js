/* eslint-env node, mocha */
const assert = require('chai').assert
const { getName } = require('guld-user')
const { getClient, listRepos, createRepo, deleteRepo } = require('./index.js')

describe('gitlab', function () {
  before(async function () {
    this.user = await getName()
  })
  it('getClient', async function () {
    var client = await getClient(this.user)
    assert.exists(client)
  })
  it('listRepos', async function () {
    this.repos = await listRepos(this.user)
    assert.exists(this.repos)
    assert.isTrue(this.repos.length > 0)
  }).timeout(10000)
  it('createRepo', async function () {
    this.repo = await createRepo('guld-repo-for-test')
    assert.exists(this.repo)
    assert.exists(this.repo.name)
    assert.equal(this.repo.name, 'guld-repo-for-test')
  }).timeout(10000)
  it('deleteRepo', async function () {
    this.repo = await deleteRepo('guld-repo-for-test')
  }).timeout(10000)
})
