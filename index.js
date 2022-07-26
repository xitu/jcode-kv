const {user, password, host, port} = require('./db.config');
const nano = require('nano')(`http://${user}:${password}@couchdb.juejin.fun`);
const db = nano.use('jcode');

const Koa = require('koa');
const Router = require('@koa/router');
const app = new Koa();
const router = new Router();
const koaBody = require('koa-body');

// TODO kv 服务说明
router.get('/', async (ctx, next) => {
  ctx.throw(403, JSON.stringify({reason: 'forbidden'}));
});

// 鉴权 + 获得 projectID
async function auth(ctx, next) {
  const origin = ctx.request.header.origin;
  const referer = ctx.request.headers.referer;
  const xProjectId = ctx.request.headers['x-project-id'];
  if(origin !== 'https://code.devrank.cn') {
    ctx.throw(403, JSON.stringify({reason: '非法访问'}));
  } else if((!xProjectId && (!referer || !referer.includes('?projectId')))) {
    ctx.throw(403, JSON.stringify({reason: '缺少projectId，需要在HTML中添加<meta name="referrer" content="no-referrer-when-downgrade"/>，Safari浏览器请取“消阻止跨站跟踪选项”。'}));
  } else {
    ctx._projectId = xProjectId || (referer && referer.split('?projectId=')[1]);
    await next();
  }
}

router.put('/doc/:id', auth, async (ctx, next) => { // insert
  const id = `${ctx.params.id}.${ctx._projectId}`;
  const data = ctx.request.body;
  const res = {};
  try {
    res.result = await db.insert({_id: id, ...data});
  } catch(ex) {
    res.error = {reason: ex.message}
  } finally {
    ctx.body = res;
  }
}).post('/doc/append/:id', auth, async (ctx, next) => { // insert or update
  const id = `${ctx.params.id}.${ctx._projectId}`;
  const data = ctx.request.body;
  const res = {};
  try {
    const {_rev} = await db.get(id);
    res.result = await db.insert({_id: id, ...data, _rev});
  } catch(ex) {
    try {
      res.result = await db.insert({_id: id, ...data});
    } catch(ex) {
      res.error = {reason: ex.message};
    }
  } finally {
    ctx.body = res;
  }
}).post('/doc/:id', auth, async (ctx, next) => { // update
  const id = `${ctx.params.id}.${ctx._projectId}`;
  const data = ctx.request.body;
  const res = {};
  try {
    const {_rev} = await db.get(id);
    res.result = await db.insert({_id: id, ...data, _rev});
  } catch(ex) {
    res.error = {reason: ex.message};
  } finally {
    ctx.body = res;
  }
}).del('/doc/:id', auth, async (ctx, next) => { // delete
  const id = `${ctx.params.id}.${ctx._projectId}`;
  const res = {};
  try {
    const {_rev} = await db.get(id);
    res.result = await db.destroy(id, _rev);
  } catch(ex) {
    res.error = {reason: ex.message};
  } finally {
    ctx.body = res;
  }
}).get('/doc/:id', auth, async (ctx, next) => { // get
  const id = `${ctx.params.id}.${ctx._projectId}`;
  const res = {};
  try {
    res.result = await db.get(id);
    delete(res.result._id);
    delete(res.result._rev);
  } catch(ex) {
    res.error = {reason: ex.message};
  } finally {
    ctx.body = res;
  }
});


app
  .use(koaBody())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(port, host);