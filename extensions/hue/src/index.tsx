import {
  List,
  Toast,
  Icon,
  Color,
  Image,
  Action,
  ActionPanel,
  showToast,
  popToRoot,
  closeMainWindow,
  getPreferenceValues,
} from "@raycast/api";
import { useState, useEffect } from "react";
import Service from "./service";

interface Preferences {
  bridge: string;
  user: string;
}
const cfg: Preferences = getPreferenceValues();
const service = new Service(cfg.bridge, cfg.user);

interface State {
  items?: { [key: string]: any[] };
  error?: Error;
}

function getData(state: State, section: string): any[] {
  if (state.items === undefined) {
    return [];
  }
  return state.items[section];
}

export default function Command() {
  const [state, setState] = useState<State>({});

  useEffect(() => {
    async function fetch() {
      try {
        const results = await service.fetch(["groups", "lights", "sensors"]);
        setState({
          items: results,
        });
      } catch (e) {
        setState({ error: e as Error });
      }
    }
    fetch();
  }, []);

  if (state.error) {
    showToast(Toast.Style.Failure, "Fetching failed", state.error.message);
  }

  return (
    <List isLoading={!state.items && !state.error} searchBarPlaceholder="Search...">
      <GroupsSection state={state} type="Room" />
      <GroupsSection state={state} type="Zone" />
      <GroupsSection state={state} type="Entertainment" />
      <LightsSection state={state} />
      <SensorSection state={state} />
    </List>
  );
}

function GroupsSection({ state, type }: { state: State; type: string }) {
  const data = getData(state, type);
  return (
    <List.Section title={type + (type != "Entertainment" ? "s" : "")} subtitle={data.length.toString()}>
      {data.map((item) => (
        <GroupItem key={item.id} item={item} />
      ))}
    </List.Section>
  );
}

function LightsSection({ state }: { state: State }) {
  const data = getData(state, "lights");
  return (
    <List.Section title="Lights" subtitle={data.length.toString()}>
      {data.map((item) => (
        <LightItem key={item.id} item={item} />
      ))}
    </List.Section>
  );
}

function SensorSection({ state }: { state: State }) {
  const data = getData(state, "sensors");
  return (
    <List.Section title="Sensors" subtitle={data.length.toString()}>
      {data.map((item) => (
        <SensorItem key={item.id} item={item} />
      ))}
    </List.Section>
  );
}

function GroupItem({ item }: { item: any }) {
  return (
    <List.Item
      icon={getIcon(item)}
      key={item.id}
      title={item.name}
      accessories={[{ text: item.lights.length + " " + (item.lights.length > 1 ? "lights" : "light") }]}
      actions={
        <ActionPanel>
          <SwitchAction item={item} />
        </ActionPanel>
      }
    />
  );
}

function LightItem({ item }: { item: any }) {
  return (
    <List.Item
      icon={getIcon(item)}
      key={item.id}
      title={item.name}
      subtitle={item.productname}
      accessories={[getReachableIcon(item), { text: item.manufacturername }]}
      actions={
        <ActionPanel>
          <SwitchAction item={item} />
        </ActionPanel>
      }
    />
  );
}

function SensorItem({ item }: { item: any }) {
  return (
    <List.Item
      icon={getIcon(item)}
      key={item.id}
      title={item.name}
      subtitle={item.productname}
      accessories={[
        getReachableIcon(item),
        { text: getSensorData(item), tooltip: "Battery " + item.config.battery + "%" },
      ]}
      actions={
        <ActionPanel>
          <SwitchAction item={item} />
        </ActionPanel>
      }
    />
  );
}

function SceneItem({ item }: { item: any }) {
  return <List.Item icon={getIcon(item)} key={item.id} title={item.name} subtitle={item.type} />;
}

function SwitchAction({ item }: { item: any }) {
  return (
    <Action
      title="Turn On/Off"
      onAction={() => {
        service.switch(item.section, item.id, item.state.all_on);
        popToRoot({ clearSearchBar: true });
        closeMainWindow({ clearRootSearch: true });
      }}
    />
  );
}

function getIcon(item: any): Image {
  if (item.section == "groups") {
    if (item.state.all_on && item.state.any_on) {
      return { source: Icon.CircleProgress100, tintColor: Color.Green };
    } else if (!item.state.all_on && item.state.any_on) {
      return { source: Icon.CircleProgress50, tintColor: Color.Yellow };
    } else {
      return { source: Icon.Circle, tintColor: Color.Red };
    }
  } else if (item.section == "sensors" || item.section == "lights") {
    const state = item.section == "sensors" ? item.config.on : item.state.on;
    if (state) {
      return { source: Icon.CircleProgress100, tintColor: Color.Green };
    } else {
      return { source: Icon.Circle, tintColor: Color.Red };
    }
  } else {
    return { source: Icon.Circle };
  }
}

function getReachableIcon(item: any): List.Item.Accessory {
  const notReachable = { icon: { source: Icon.ExclamationMark, tintColor: Color.Red }, tooltip: "Not reachable" };
  if (item.section == "sensors") {
    if (!item.config.reachable) return notReachable;
  } else if (item.section == "lights") {
    if (!item.state.reachable) return notReachable;
  }
  return { icon: { source: "assets/blank.png" } };
}

function getSensorData(item: any): string {
  switch (item.type) {
    case "ZLLTemperature":
      return "Temperature: " + item.state.temperature / 100 + "°C";
    case "ZLLLightLevel":
      return "Lightlevel: " + item.state.lightlevel + " lx";
    case "ZLLPresence":
      return item.config.on ? "Presence: " + (item.state.presence ? "detected" : "not detected") : "deactivated";
    default:
      return "";
  }
}
