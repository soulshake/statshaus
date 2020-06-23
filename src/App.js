import $ from "jquery";
import 'bootstrap/dist/css/bootstrap.min.css';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import React from 'react';
import Table from 'react-bootstrap/Table';
import moment from 'moment';
import { orderBy } from 'lodash';
import { useInterval } from './Hooks.js';
import './App.css';

const username = process.env.REACT_APP_USERNAME;
const password = process.env.REACT_APP_PASSWORD;

function App() {
  const [error, setError] = React.useState(null);

  if ((!username || !password) && !error) {
    setError(`USERNAME and/or PASSWORD environment variables not present. USERNAME: ${username} PASSWORD: ${password}`);
  }

  return (
    <div className="App">
      <Container>
        <header className="App-header">
          <p> Wilkommen bei StatsHaus!  </p>
        </header>
        <Error error={error} setError={setError} />
        <Stats error={error} setError={setError} />
        <a
          className="App-link"
          href="https://highfive.container.training/stats/data.json"
          target="_blank"
          rel="noopener noreferrer"
        >
          View stats
        </a>
      </Container>
    </div>
  );
}

function Error({ error, setError }) {
  if (!error) { return null; }
  return (
    <Alert dismissible onClose={(e) => setError(null)} variant="danger">
      {error}
    </Alert>
  );
}


function Stats(props) {
  const { error, setError } = props;
  const [lastFetched, setLastFetched] = React.useState(null);
  const [fetchInterval, setFetchInterval] = React.useState(10);
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [count, setCount] = React.useState(0);

  useInterval(() => {
    if (!fetchInterval) {
      // We've been paused; set loading to false. In theory, we should cancel pending ajax calls as well.
      loading && setLoading(false);
      return;
    }
    if (loading) {
      return;
    }
    if (count >= fetchInterval) {
      console.log("count has reached max, fetching and resetting");
      setCount(0);
      fetchStats();
    } else if (error) {
      console.log("not attempting while error is present", error)
    } else {
      setCount(count + 1);
      console.log("setting count", count + 1);
    }
  }, 2000);

  async function fetchStats() {
    if (loading) { return; }  // stats are already being fetched

    setLoading(true);
    if (!error) {
      console.warn("FETCHING STATS");
      const url = "https://highfive.container.training/stats/data.json";
      const proxyurl = "https://cors-anywhere.herokuapp.com/";
      $.ajax({
        url: proxyurl + url,
        // url: url,
        dataType: 'json',
        headers: {
          "Authorization": "Basic " + btoa(username + ":" + password)
        },
        success: async function (response) {
          console.log('fetched stats:', response);
          setStats(processStats(response.user2lastactivity));
          setLastFetched(response.now);
          setLoading(false);
        },
        error: function (response, wat, why) {
          setLoading(false);
          console.error('noo got an error', response, wat, why);
          let errStr = "";
          if (response.status) { errStr += response.status };
          if (response.statusText) { errStr += " / " + response.statusText };
          if (response.responseText) { errStr += " / " + response.responseText };
          if (response.responseJSON) { errStr += " / " + response.responseJSON };
          console.error(errStr);
          setError(JSON.stringify(response));
        },
      });
    }
  }

  React.useEffect(() => {
    if (!stats && !error) {
      console.debug("fetching initial stats");
      fetchStats();
    }
  });

  if (error) {
    return <div>Couldn't load stats :(</div>
  }
  if (!stats) {
    return <div>Loading...</div>;
  }
  return (
    <StatsTable stats={stats} fetchStats={fetchStats} setFetchInterval={setFetchInterval} fetchInterval={fetchInterval} loading={loading} lastFetched={lastFetched} />
  );
}


function StatsTable(props) {
  const { stats, fetchStats, fetchInterval, setFetchInterval, loading, lastFetched } = props;
  const [sortedStats, setSortedStats] = React.useState(stats);
  const [sortOrder, setSortOrder] = React.useState("alphabetic");
  const [orderType, setOrderType] = React.useState("desc");
  const isPaused = !Boolean(fetchInterval);

  React.useEffect(() => {
    let newSortedStats = orderBy(stats, sortOrder, orderType);
    if (JSON.stringify(newSortedStats) !== JSON.stringify(sortedStats)) {
      console.log('sortOrder/stats/orderType changed: ', stats, sortOrder, orderType);
      setSortedStats(newSortedStats);
    }
  }, [stats, sortOrder, orderType, sortedStats]
  );

  function handleSort(e, val) {
    if (val === sortOrder) {
      setOrderType(orderType === "asc" ? "desc" : "asc");
      return;
    }
    setSortOrder(val);
  }

  function handleResume(e) {
    // Fetch once immediately and then set fetch interval
    fetchStats();
    setFetchInterval(5);
  }

  function extra(type) {
    if (type === sortOrder) {
      return orderType === "desc" ? "(asc)" : "(desc)";
    }
    return null;
  }

  return (
    <div>
      Last fetched: {moment.unix(lastFetched).fromNow()}
      {' '}
      {fetchInterval
        ? <em>(Fetching every {fetchInterval / 2} seconds)</em>
        : <em>(Paused)</em>
      }

      <div className="m-1">
        <Button variant="info" size="sm" onClick={(e) => handleSort(e, "name")}>Sort by name {extra("name")}</Button>
        {' '}
        <Button variant="info" size="sm" onClick={(e) => handleSort(e, "timestamp")}>Sort by time {extra("timestamp")}</Button>
        {' '}
        {isPaused
          ?  (
            <>
              <Button variant="success" disabled={loading} size="sm" onClick={handleResume}>Resume</Button>
              {' '}
              <Button variant="info" disabled={loading} size="sm" onClick={fetchStats}>Refresh</Button>
            </>
          ) : (
            <>
              <Button variant="info" size="sm" onClick={(e) => setFetchInterval(null)}>Pause</Button>
              {' '}
              {/* Show the refresh button disabled so the layout doesn't jump around */}
              <Button variant="info" disabled={true} size="sm" onClick={fetchStats}>Refresh</Button>
            </>
          )
        }
      </div>

      <Table size="sm" hover striped>
        <thead>
          <tr>
            <th>User</th>
            <th>Last seen</th>
            <th>Stream</th>
          </tr>
        </thead>

        <tbody>

          {sortedStats.map((stat, index) => (
            <tr key={index}>
              <td>{stat.name}</td>
              <td>{moment.unix(stat.timestamp).fromNow()}</td>
              <td>{stat.stream}</td>
            </tr>

          ))}
        </tbody>
      </Table>
      <div>
        Ordering by: {sortOrder} ({orderType})
      </div>
    </div>
  );
}

function processStats(stats) {
  var ret = []
  Object.keys(stats).forEach(function(name) {
    ret.push({
      name: name,
      timestamp: stats[name][0],
      stream: stats[name][1],
    });
  });
  return ret;
}


export default App;
