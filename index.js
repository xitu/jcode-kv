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
  const origin = ctx.request.header.origin;
  const referer = ctx.request.headers.referer;
  if(origin !== 'https://code.devrank.cn') {
    ctx.throw(403, JSON.stringify({reason: '非法访问'}));
  } else if(!referer || !referer.includes('?projectId')) {
    ctx.throw(403, JSON.stringify({reason: '缺少projectId, 需要在HTML中添加<meta name="referrer" content="no-referrer-when-downgrade"/>'}));
  } else {
    await next();
  }
}

// insert
router.put('/doc/:id', auth, async (ctx, next) => {
  const {id} = ctx.params;
  const data = ctx.request.body;
  try {
    const res = await db.insert({_id: id, ...data});
    ctx.body = res;
  } catch(ex) {
    ctx.throw(403, JSON.stringify({reason: ex.message}));
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
    ctx.throw(403, JSON.stringify({reason: ex.message}));
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
    ctx.throw(404, JSON.stringify({reason: ex.message}));
  }
});

// get
router.get('/doc/:id', auth, async (ctx, next) => {
  try {
    const {id} = ctx.params;
    const info = await db.get(id);
    ctx.body = info;
  } catch(ex) {
    ctx.throw(404, JSON.stringify({reason: ex.message}));
  }
});


app
  .use(koaBody())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(port, host);