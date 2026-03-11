fetch('http://localhost:3000/api/investments')
  .then(res => res.json())
  .then(async data => {
      console.log('Investments:', data);
      if (data.length > 0) {
          const testId = data[0].id;
          console.log('Trying to edit ID:', testId);
          const putRes = await fetch(`http://localhost:3000/api/investments/${testId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: data[0].name + ' edited', type: data[0].type, current_value: 999, target_value: 1000 })
          });
          console.log('PUT status:', putRes.status);
          const putData = await putRes.json().catch(e => "No JSON");
          console.log('PUT res:', putData);
      } else {
          console.log('No data to test edit/delete');
      }
  })
  .catch(err => console.error('Fetch error:', err));
