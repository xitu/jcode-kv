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
  const res = await db.list();
  ctx.body = res;
});

// 鉴权 + 获得 projectID
async function auth(ctx, next) {
  console.log(ctx.request.headers);
  await next();
}

// insert
router.put('/doc/:id', auth, async (ctx, next) => {
  const {id} = ctx.params;
  const data = ctx.request.body;
  try {
    const res = await db.insert({_id: id, ...data});
    ctx.body = res;
  } catch(ex) {
    ctx.throw(403, ex.message);
  }
});

// post
router.post('/doc/:id', auth, async (ctx, next) => {
  const {id} = ctx.params;
  const data = ctx.request.body;
  try {
    const {_rev} = await db.get(id);
    const res = await db.insert({_id: id, ...data, _rev});
    ctx.body = res;
  } catch(ex) {
    ctx.throw(403, ex.message);
  }
});

// delete
router.del('/doc/:id', auth, async (ctx, next) => {
  const {id} = ctx.params;
  try {
    const {_rev} = await db.get(id);
    const res = await db.destroy(id, _rev);
    ctx.body = res;
  } catch(ex) {
    ctx.throw(404, ex.message);
  }
});

// get
router.get('/doc/:id', auth, async (ctx, next) => {
  try {
    const {id} = ctx.params;
    const info = await db.get(id);
    ctx.body = info;
  } catch(ex) {
    ctx.throw(404, ex.message);
  }
});


app
  .use(koaBody())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(port, host);