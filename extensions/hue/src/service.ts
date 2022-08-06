import https from "https";
import fetch, { Headers } from "node-fetch";

const groupBy = function (groups: any[], key: string): { [key: string]: any[] } {
  return groups.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

export interface Response {
  [key: string]: any[];
}

export default class Service {
  baseURL: string;
  headers: Headers;
  agent: any;

  constructor(bridge: string, user: string) {
    this.baseURL = bridge + "/api/" + user;
    this.headers = new Headers({
      "Content-Type": "application/json",
    });
    this.agent = this.baseURL.startsWith("https")
      ? new https.Agent({
          rejectUnauthorized: false,
        })
      : undefined;
  }

  async fetch(types: string[]): Promise<Response> {
    const response = await fetch(this.baseURL, {
      method: "get",
      headers: this.headers,
      agent: this.agent,
    });

    const json = (await response.json()) as Response;

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    let ret: Response = {};
    for (const type in json) {
      if (!types.includes(type)) continue;
      const items = modify(json[type], type);
      if (type == "groups") {
        const grp = groupBy(items, "type");
        ret = Object.assign({}, ret, grp);
      } else ret[type] = items;
    }

    if (Object.keys(ret).length === 0) {
      throw new Error("no device found");
    }
    return ret;
  }

  async switch(section: string, id: string, state: boolean): Promise<boolean> {
    let endpoint = "state";
    if (section == "groups") endpoint = "action";
    else if (section == "sensors") endpoint = "config";

    const url = this.baseURL + "/" + section + "/" + id + "/" + endpoint;
    const response = await fetch(url, {
      method: "put",
      headers: this.headers,
      agent: this.agent,
      body: JSON.stringify({ on: !state }),
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    return !state;
  }
}

function modify(res: any, section: string): any[] {
  const ret: any[] = [];
  for (const id in res) {
    const sensor: any = res[id];
    if (section == "sensors" && !sensor.type.startsWith("ZLL")) continue;
    sensor.id = id;
    sensor.section = section;
    ret.push(sensor);
    ret.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
  }
  return ret;
}
