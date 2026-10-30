// -----------------------------------------------------------------------------
// An in-memory YOURLS behind the `request` seam of src/yourls/client.js. Its
// answers have the shape of the real YOURLS 1.10.6 ones recorded in
// test/fixtures/yourls/v1.10.6.json (counts as numbers, statusCode as a
// string, `links` keyed link_1, link_2…).
// -----------------------------------------------------------------------------

export const BASE = 'https://sho.rt';
export const SIGNATURE = '0123456789abcdef0123456789abcdef';

const json = (status, body) => ({ status, body: JSON.stringify(body) });

export class FakeYourls {
  constructor({ version = '1.10.6', base = BASE } = {}) {
    this.version = version;
    this.base = base;
    /** @type {Map<string, { keyword, url, title, clicks }>} */
    this.links = new Map();
    this.next = 1;
    // Failure switches.
    this.down = false;
    this.html = false;
    this.redirect = false;
    this.gate = null;
    /** @type {object[]} the forms received, in order */
    this.requests = [];
    this.request = this.request.bind(this);
  }

  addLink({ keyword, url = `https://www.example.com/${keyword}`, title = '', clicks = 0 }) {
    this.links.set(keyword, { keyword, url, title: title || url, clicks });
  }

  click(keyword, count = 1) {
    this.links.get(keyword).clicks += count;
  }

  short(link) {
    return `${this.base}/${link.keyword}`;
  }

  async request(url, { form }) {
    this.requests.push(form);
    // A promise to hold the answers on (slow server, overlapping reads).
    await this.gate;
    if (this.down) {
      const err = new TypeError('fetch failed');
      err.cause = { code: 'ECONNREFUSED' };
      throw err;
    }
    if (this.redirect) {
      return { status: 301, body: '' };
    }
    if (this.html || url !== `${this.base}/yourls-api.php`) {
      return { status: 404, body: '<html><body>Not Found</body></html>' };
    }
    if (form.format !== 'json') {
      return { status: 200, body: '<result/>' };
    }
    if (form.signature !== SIGNATURE && !(form.username === 'admin' && form.password === 'pw')) {
      return json(403, { message: 'Please log in', errorCode: '403', callback: '' });
    }
    const links = [...this.links.values()];
    const totals = {
      total_links: links.length,
      total_clicks: links.reduce((sum, link) => sum + link.clicks, 0),
    };
    const view = (link) => ({
      shorturl: this.short(link),
      url: link.url,
      title: link.title,
      timestamp: '2026-10-30 01:50:03',
      ip: '192.0.2.4',
      clicks: link.clicks,
    });
    switch (form.action) {
      case 'version':
        return json(200, { version: this.version });
      case 'stats': {
        const top = links
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, Number(form.limit) || 10)
          .map((link, index) => [`link_${index + 1}`, view(link)]);
        return json(200, {
          links: top.length ? Object.fromEntries(top) : [],
          stats: totals,
          statusCode: '200',
          message: 'success',
        });
      }
      case 'url-stats': {
        const keyword = String(form.shorturl).split('/').pop();
        const link = this.links.get(keyword);
        if (!link) {
          return json(404, { statusCode: '404', message: 'Error: short URL not found' });
        }
        return json(200, { statusCode: '200', message: 'success', link: view(link) });
      }
      case 'shorturl':
        return this.shorten(form);
      default:
        return json(400, { errorCode: '400', message: 'Unknown or missing "action" parameter' });
    }
  }

  shorten({ url, keyword, title }) {
    if (!url) {
      return json(400, {
        status: 'fail',
        code: 'error:nourl',
        message: 'Missing or malformed URL',
        errorCode: '400',
        statusCode: '400',
      });
    }
    const existing = [...this.links.values()].find((link) => link.url === url);
    if (existing) {
      return json(409, {
        status: 'fail',
        code: 'error:url',
        message: `${url} already exists in database`,
        errorCode: '409',
        statusCode: '409',
        url: { keyword: existing.keyword, url, title: existing.title, clicks: existing.clicks },
        title: existing.title,
        shorturl: this.short(existing),
      });
    }
    if (keyword && this.links.has(keyword)) {
      return json(400, {
        status: 'fail',
        code: 'error:keyword',
        message: `Short URL ${keyword} already exists in database or is reserved`,
        errorCode: '400',
        statusCode: '400',
      });
    }
    const chosen = keyword || String(this.next++);
    this.addLink({ keyword: chosen, url, title });
    const link = this.links.get(chosen);
    return json(200, {
      status: 'success',
      code: '',
      message: `${url} added to database`,
      errorCode: '',
      statusCode: '200',
      url: {
        keyword: chosen,
        url,
        title: link.title,
        date: '2026-10-30 01:50:02',
        ip: '192.0.2.4',
      },
      title: link.title,
      shorturl: this.short(link),
    });
  }
}
